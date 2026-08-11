const base = "http://127.0.0.1:5173";
for (const p of ["/", "/src/main.jsx", "/src/App.jsx"]) {
  try {
    const r = await fetch(base + p);
    const t = await r.text();
    console.log(p, r.status, t.length, t.slice(0, 80).replace(/\n/g, " "));
  } catch (e) {
    console.log(p, "FAIL", String(e).slice(0, 120));
  }
}