const segmenter = new Intl.Segmenter('zh-TW', { granularity: 'word' });
const genericWords = new Set([
  '入門', '初學', '初階', '基礎', '進階', '課程', '教學', '從零', '練習', '實作',
  '學習', '完整', '快速', '開始', '使用', '技巧', '基本', '上手',
  'beginner', 'course', 'intro', 'introduction', 'learn', 'tutorial',
]);
const MAX_REFERENCE_COURSES = 200;
const STARTER_PRICE_RANGE = { min: 1, max: 10 };

function normalized(value) {
  return value.normalize('NFKC').trim().toLowerCase();
}

function subjectTerms(value) {
  return new Set([...segmenter.segment(normalized(value))]
    .filter(({ segment, isWordLike }) => isWordLike && segment.length >= 2 && !genericWords.has(segment))
    .map(({ segment }) => segment));
}

function matchesSubject(title, terms) {
  return [...subjectTerms(title)].some(term => terms.has(term));
}

function roundSkill(value) {
  return Math.max(1, Math.round(value * 10)) / 10;
}

function summarizePrices(candidates, terms, fallbackBasis) {
  if (!candidates.length) return null;
  const similar = terms.size ? candidates.filter(course => matchesSubject(course.title, terms)) : [];
  // Use topic matches only when at least two listings corroborate the topic's pricing.
  const useSimilar = similar.length >= 2;
  const comparable = useSimilar ? similar : candidates;
  const basis = useSimilar ? 'similar' : fallbackBasis;
  const prices = comparable.map(course => Number(course.price)).sort((left, right) => left - right);
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
  // Trim both tails for five or more listings so an extreme price doesn't set the bounds.
  const trim = Math.floor(prices.length / 5);
  return {
    basis,
    referenceCount: prices.length,
    min: roundSkill(prices[trim]),
    median: roundSkill(median),
    max: roundSkill(prices[prices.length - 1 - trim]),
  };
}

async function getCoursePricingOptions(db, { categories, skill }) {
  const { rows } = await db.query(`WITH ranked AS (
    SELECT c.title, s.category, c.price::double precision AS price,
      ROW_NUMBER() OVER (ORDER BY c.updated_at DESC, c.course_id DESC) AS catalog_rank,
      ROW_NUMBER() OVER (PARTITION BY LOWER(BTRIM(s.category)) ORDER BY c.updated_at DESC, c.course_id DESC) AS category_rank
    FROM courses c JOIN skills s ON s.skill_id=c.skill_id
    WHERE c.is_active AND c.price>0 AND c.price<=1000000000
  )
  SELECT title, category, price FROM ranked
  WHERE catalog_rank<=$1 OR (category_rank<=$1 AND LOWER(BTRIM(category))=ANY($2::text[]))
  ORDER BY catalog_rank`, [MAX_REFERENCE_COURSES, categories.map(normalized)]);

  const terms = subjectTerms(skill);
  const byCategory = {};
  for (const category of categories) {
    const categoryKey = normalized(category);
    const candidates = rows.filter(course => normalized(course.category) === categoryKey).slice(0, MAX_REFERENCE_COURSES);
    const pricing = summarizePrices(candidates, terms, 'category');
    if (pricing) byCategory[category] = pricing;
  }
  return { byCategory, catalog: summarizePrices(rows.slice(0, MAX_REFERENCE_COURSES), terms, 'catalog') };
}

function normalizeSuggestedPrice(price, pricing) {
  const { min, max } = pricing || STARTER_PRICE_RANGE;
  return Math.min(max, Math.max(min, roundSkill(price)));
}

module.exports = { getCoursePricingOptions, normalizeSuggestedPrice, STARTER_PRICE_RANGE };
