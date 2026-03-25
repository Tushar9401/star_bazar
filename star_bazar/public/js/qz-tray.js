// (function () {
//     function loadQZ() {
//         return new Promise((resolve, reject) => {
//             if (window.qz) {
//                 console.log("QZ already loaded");
//                 resolve();
//                 return;
//             }

//             const script = document.createElement("script");
//             script.src = "https://cdn.jsdelivr.net/npm/qz-tray/qz-tray.js";
//             script.onload = function () {
//                 console.log("QZ library loaded");
//                 resolve();
//             };
//             script.onerror = function (e) {
//                 reject(e);
//             };
//             document.head.appendChild(script);
//         });
//     }

//     window.ensureQZReady = async function () {
//         await loadQZ();

//         qz.security.setCertificatePromise((resolve, reject) => {
//             console.log("Certificate requested");
//             resolve(null);
//         });

//         qz.security.setSignaturePromise((toSign) => {
//             return (resolve, reject) => {
//                 console.log("Signature requested for:", toSign);
//                 resolve();
//             };
//         });

//         console.log("QZ security configured");
//     };
// })();

// (function () {
//     function loadQZ() {
//         return new Promise((resolve, reject) => {
//             if (window.qz) {
//                 console.log("QZ already loaded");
//                 resolve();
//                 return;
//             }

//             const script = document.createElement("script");
//             script.src = "https://cdn.jsdelivr.net/npm/qz-tray/qz-tray.js";
//             script.onload = function () {
//                 console.log("QZ library loaded");
//                 resolve();
//             };
//             script.onerror = function (e) {
//                 console.error("Failed to load QZ library", e);
//                 reject(e);
//             };
//             document.head.appendChild(script);
//         });
//     }

//     window.ensureQZReady = async function () {
//         await loadQZ();

//         qz.security.setCertificatePromise(function (resolve, reject) {
//             fetch("/assets/star_bazar/cert.pem")
//                 .then(res => res.text())
//                 .then(cert => {
//                     console.log("Certificate loaded");
//                     resolve(cert);
//                 })
//                 .catch(err => {
//                     console.error("Certificate load failed", err);
//                     reject(err);
//                 });
//         });

//         qz.security.setSignaturePromise(function (toSign) {
//             return function (resolve, reject) {
//                 fetch("/api/method/star_bazar.api.sign_qz", {
//                     method: "POST",
//                     headers: {
//                         "Content-Type": "application/json"
//                     },
//                     body: JSON.stringify({ request: toSign })
//                 })
//                 .then(res => res.json())
//                 .then(data => {
//                     console.log("Signature received");
//                     resolve(data.message);
//                 })
//                 .catch(err => {
//                     console.error("Signature request failed", err);
//                     reject(err);
//                 });
//             };
//         });

//         console.log("QZ security configured");
//     };
// })();

(function () {
    function loadQZ() {
        return new Promise((resolve, reject) => {
            if (window.qz) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/qz-tray/qz-tray.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    window.ensureQZReady = async function () {
        await loadQZ();

        qz.security.setCertificatePromise(function (resolve, reject) {
            fetch("/assets/star_bazar/digital-certificate.txt", {
                cache: "no-store",
                headers: { "Content-Type": "text/plain" }
            })
            .then(res => res.ok ? res.text() : Promise.reject("cert load failed"))
            .then(resolve)
            .catch(reject);
        });

        qz.security.setSignatureAlgorithm("SHA512");

        qz.security.setSignaturePromise(function (toSign) {
            return function (resolve, reject) {
                fetch("/api/method/star_bazar.api.sign_qz?request=" + encodeURIComponent(toSign), {
                    cache: "no-store"
                })
                .then(res => {
                    if (!res.ok) throw new Error("sign failed");
                    return res.text();
                })
                .then(resolve)
                .catch(err => {
                    console.error("Signing failed", err);
                    reject(err);
                });
            };
        });
        };
})();