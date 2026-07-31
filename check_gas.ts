async function test() {
    const url = "https://script.google.com/macros/s/AKfycbwAaUkgEk2fRd2idgj8kTPoPdIRWKm8s69NkyXQQ6wQFDdpEcvAY2x4ShIjcxSipQbl/exec";
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'notify', targetUserId: 'Uf6aa9e01e07f310b2ec3699dfb6201df', message: 'Test message from server' })
    });
    console.log(res.status, await res.text());
}
test();
