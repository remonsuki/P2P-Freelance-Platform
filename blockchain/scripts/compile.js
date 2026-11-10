const fs = require('node:fs');
const path = require('node:path');
const solc = require('solc');

function compile() {
  const sources = {
    'SkillEscrow.sol': { content: fs.readFileSync(path.join(__dirname, '../contracts/SkillEscrow.sol'), 'utf8') },
    'SkillToken.sol': { content: fs.readFileSync(path.join(__dirname, '../../file/SkillToken.sol'), 'utf8') },
  };
  const input = { language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 },
    evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import(file) {
    try { return { contents: fs.readFileSync(require.resolve(file, { paths: [path.join(__dirname, '..')] }), 'utf8') }; }
    catch { return { error: `Import not found: ${file}` }; }
  } }));
  const errors = (output.errors || []).filter(e => e.severity === 'error');
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  return { SkillEscrow: output.contracts['SkillEscrow.sol'].SkillEscrow, SkillToken: output.contracts['SkillToken.sol'].SkillToken };
}
if (require.main === module) {
  const directory = path.join(__dirname, '../artifacts');
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, artifact] of Object.entries(compile())) fs.writeFileSync(path.join(directory, `${name}.json`), JSON.stringify(artifact, null, 2));
  console.log('Compiled SkillToken and SkillEscrow (Solidity 0.8.30, Shanghai EVM).');
}
module.exports = { compile };
