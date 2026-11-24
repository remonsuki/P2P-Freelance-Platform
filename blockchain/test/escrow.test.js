const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Interface, Wallet, parseUnits, verifyTypedData } = require('ethers');
const protocol = require('../protocol.json');
const { compile } = require('../scripts/compile');
const { SEPOLIA_CHAIN_ID } = require('../sepolia');

const sharedAbi = new Interface(protocol.abi);

function assertParameters(actual, expected, readNames = false) {
  assert.equal(actual.length, expected.length);
  for (const [index, parameter] of expected.entries()) {
    const compiled = actual[index];
    assert.equal(compiled.format('sighash'), parameter.format('sighash'));
    if (readNames && parameter.name) assert.equal(compiled.name, parameter.name);
    if (parameter.indexed !== null) assert.equal(Boolean(compiled.indexed), Boolean(parameter.indexed));
    if (parameter.components) assertParameters(compiled.components, parameter.components, true);
  }
}

test('offline Solidity compilation preserves the escrow and token interfaces', () => {
  const { SkillEscrow, SkillToken } = compile();
  for (const artifact of [SkillEscrow, SkillToken]) {
    assert.match(artifact.evm.bytecode.object, /^[a-f0-9]+$/);
  }
  const escrow = new Interface(SkillEscrow.abi);
  const token = new Interface(SkillToken.abi);
  for (const fragment of sharedAbi.fragments) {
    const signature = fragment.format('sighash');
    if (fragment.type === 'event') {
      assertParameters(escrow.getEvent(signature).inputs, fragment.inputs, true);
      continue;
    }
    const compiled = escrow.getFunction(signature);
    assertParameters(compiled.inputs, fragment.inputs);
    assertParameters(compiled.outputs, fragment.outputs);
    assert.ok(compiled.stateMutability === fragment.stateMutability
      || (compiled.stateMutability === 'pure' && fragment.stateMutability === 'view'));
  }
  for (const signature of ['balanceOf(address)', 'allowance(address,address)', 'approve(address,uint256)',
    'transfer(address,uint256)', 'decimals()', 'symbol()', 'mint(address,uint256)']) {
    assert.ok(token.getFunction(signature));
  }
  const quote = escrow.getFunction('fund').inputs[0];
  assert.deepEqual(quote.components.map(({ name, type }) => ({ name, type })), protocol.types.Quote);
});

test('an offline quote signs the Sepolia escrow domain and round-trips through the ABI', async () => {
  const signer = Wallet.createRandom();
  const domain = {
    name: protocol.name, version: protocol.version, chainId: SEPOLIA_CHAIN_ID,
    verifyingContract: '0x4000000000000000000000000000000000000004',
  };
  const quote = {
    paymentId: `0x${'01'.repeat(32)}`, slotKey: `0x${'02'.repeat(32)}`,
    student: '0x2000000000000000000000000000000000000002', teacher: '0x3000000000000000000000000000000000000003',
    amount: parseUnits('2.123456', 18), startsAt: 10_600n, endsAt: 14_200n, deadline: 10_599n,
  };
  const signature = await signer.signTypedData(domain, protocol.types, quote);
  const calldata = sharedAbi.encodeFunctionData('fund', [quote, signature]);
  const [decoded, decodedSignature] = sharedAbi.decodeFunctionData('fund', calldata);
  for (const [key, value] of Object.entries(quote)) assert.equal(decoded[key], value);
  assert.equal(verifyTypedData(domain, protocol.types, quote, decodedSignature), signer.address);
  assert.notEqual(verifyTypedData(domain, protocol.types, { ...quote, amount: 1n }, signature), signer.address);
  assert.notEqual(verifyTypedData({ ...domain, chainId: 1 }, protocol.types, quote, signature), signer.address);
});
