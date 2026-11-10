const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Wallet,parseUnits}=require('ethers');
const protocol=require('../protocol.json');
const {fixture}=require('./helpers');

test('signed SKILL escrow rejects tampering and duplicate funding; cancellation refunds exactly once',async t=>{
  const f=await fixture(t);const {q,signature}=await f.quote();
  const balance=await f.token.balanceOf(q.student);
  await assert.rejects(f.fund({...q,amount:'1'},signature));
  await assert.rejects(f.fund(q,await Wallet.createRandom().signTypedData(f.domain,protocol.types,q)));
  await assert.rejects(f.fund(q,signature,f.actors[3]));
  await assert.rejects(f.fund(q,await f.signer.signTypedData({...f.domain,chainId:11155111},protocol.types,q)));
  await f.fund(q,signature);
  assert.equal(await f.token.balanceOf(await f.escrow.getAddress()),BigInt(q.amount));
  assert.equal(await f.token.balanceOf(q.student),balance-BigInt(q.amount));
  await assert.rejects(f.fund(q,signature));
  const competing=await f.quote({slotKey:q.slotKey});await assert.rejects(f.fund(competing.q,competing.signature));
  await assert.rejects(f.escrow.connect(f.actors[2]).cancel(q.paymentId));
  await (await f.escrow.connect(f.actors[1]).cancel(q.paymentId)).wait();
  assert.equal(await f.token.balanceOf(q.student),balance);
  await assert.rejects(f.escrow.connect(f.actors[1]).cancel(q.paymentId));
  await assert.rejects(f.fund(q,signature));
  await f.fund(competing.q,competing.signature);
});

test('only the student can complete after course end; teacher receives exact SKILL once',async t=>{
  const f=await fixture(t);const {q,signature}=await f.quote();await f.fund(q,signature);
  await assert.rejects(f.escrow.connect(f.actors[1]).complete(q.paymentId));
  await f.advance(7201);
  await assert.rejects(f.escrow.connect(f.actors[2]).complete(q.paymentId));
  await (await f.escrow.connect(f.actors[1]).complete(q.paymentId)).wait();
  assert.equal(await f.token.balanceOf(q.teacher),BigInt(q.amount));
  await assert.rejects(f.escrow.connect(f.actors[1]).complete(q.paymentId));
  assert.equal((await f.escrow.getPayment(q.paymentId)).state,3n);
});

test('disputes freeze settlement and timeout claims; only teacher can refund',async t=>{
  const f=await fixture(t);const {q,signature}=await f.quote();await f.fund(q,signature);
  await assert.rejects(f.escrow.connect(f.actors[1]).dispute(q.paymentId));
  await f.advance(3601);
  await (await f.escrow.connect(f.actors[1]).dispute(q.paymentId)).wait();
  await f.advance(8*86400);
  await assert.rejects(f.escrow.connect(f.actors[1]).complete(q.paymentId));
  await assert.rejects(f.escrow.connect(f.actors[2]).claim(q.paymentId));
  await assert.rejects(f.escrow.connect(f.actors[1]).refund(q.paymentId));
  await (await f.escrow.connect(f.actors[2]).refund(q.paymentId)).wait();
  assert.equal(await f.token.balanceOf(q.student),parseUnits('1000',18));
  await assert.rejects(f.escrow.connect(f.actors[2]).refund(q.paymentId));
});

test('teacher timeout claim needs seven days and no dispute; expired or unfunded quotes cannot settle',async t=>{
  const f=await fixture(t);const expired=await f.quote();await f.advance(601);
  await assert.rejects(f.fund(expired.q,expired.signature));
  const {q,signature}=await f.quote();await f.fund(q,signature);
  await assert.rejects(f.escrow.connect(f.actors[2]).claim(q.paymentId));
  await f.advance(7200+7*86400+1);
  await assert.rejects(f.escrow.connect(f.actors[1]).cancel(q.paymentId));
  await (await f.escrow.connect(f.actors[2]).claim(q.paymentId)).wait();
  assert.equal(await f.token.balanceOf(q.teacher),BigInt(q.amount));
  await assert.rejects(f.escrow.connect(f.actors[1]).complete(expired.q.paymentId));
});
