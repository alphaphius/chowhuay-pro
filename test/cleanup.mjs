// Reset the backend to a clean slate + default settings.
// Runs from inside Chrome because direct node->GAS fetch is unreliable on some
// networks. Connect to an existing page, execute the cleanup, print result.
//
//   node test/cleanup.mjs

const CDP = 'http://127.0.0.1:9222';

const tabs = await (await fetch(CDP + '/json')).json();
const page = tabs.find((t) => t.type === 'page');
if (!page) {
  console.error('no page tab found');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  }
};
await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');

const expr = `(async () => {
  const call = async (action, body={}) => {
    const res = await fetch(window.Api.gasUrl() + "?action=" + encodeURIComponent(action) + "&u=" + Date.now(), {method:"POST", headers:{"Content-Type":"text/plain"}, body:JSON.stringify(body)});
    return res.json();
  };
  let all = await call("getAll");
  for (const s of all.sales) await call("sale:delete", {id:s.id});
  all = await call("getAll");
  for (const p of all.products) await call("product:delete", {id:p.id});
  all = await call("getAll");
  for (const p of all.purchases) await call("purchase:delete", {id:p.id});
  all = await call("getAll");
  for (const c of all.categories) await call("category:delete", {name:c});
  await call("settings:set", {key:"passcode", value:"1234"});
  await call("settings:set", {key:"storeName", value:"ร้านโชว์ห่วยของฉัน"});
  await call("settings:set", {key:"theme", value:"blue"});
  await call("settings:set", {key:"dark", value:"0"});
  const f = await call("getAll");
  return JSON.stringify({cleaned:true, products:f.products.length, sales:f.sales.length, purchases:f.purchases.length, categories:f.categories.length, settings:f.settings});
})()`;

const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
console.log(r.result.value || JSON.stringify(r.result));
ws.close();
process.exit(0);
