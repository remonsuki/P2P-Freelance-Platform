/** 點數對應鏈上 SKILL 代幣（ERC20，18 位小數），所以保留小數，只檢查是不是有效數字 */
function toPoints(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

module.exports = { toPoints };