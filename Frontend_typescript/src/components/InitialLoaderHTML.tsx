export function InitialLoaderHTML() {
  const html = `
<div id="initial-loader" style="position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;background-color:hsl(210,20%,98%);transition:opacity 0.4s ease">
  <div style="display:flex;flex-direction:column;align-items:center;gap:24px">
    <div style="position:relative">
      <div style="height:48px;width:48px;border-radius:12px;background-color:hsl(220,25%,15%);display:flex;align-items:center;justify-center;box-shadow:0 10px 30px -10px rgba(28,36,52,0.3)">
        <span style="font-family:'Inter Tight',Inter,system-ui,sans-serif;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.02em;margin:auto">C</span>
      </div>
      <div style="position:absolute;top:-6px;left:-6px;right:-6px;bottom:-6px;animation:spin 2s linear infinite">
        <div style="height:6px;width:6px;border-radius:50%;background-color:hsl(220,20%,12%);position:absolute;top:0;left:50%;transform:translateX(-50%)"></div>
      </div>
    </div>
    <div style="text-align:center">
      <h1 style="font-family:'Inter Tight',Inter,system-ui,sans-serif;font-size:18px;font-weight:700;color:hsl(220,20%,12%);letter-spacing:-0.02em;margin:0">
        PLOM<span style="font-weight:400;opacity:0.5">CLAIM</span>
      </h1>
      <p id="loader-text" style="margin-top:4px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:hsl(220,10%,45%);letter-spacing:0.05em">Initializing</p>
    </div>
    <div style="width:192px;height:4px;background-color:hsl(220,15%,90%);border-radius:9999px;overflow:hidden">
      <div style="height:100%;width:40%;background-color:hsl(220,25%,15%);border-radius:9999px;animation:loadingBar 1.5s ease-in-out infinite"></div>
    </div>
  </div>
  <style>
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes loadingBar { 0% { transform: translateX(-100%); } 50% { transform: translateX(100%); } 100% { transform: translateX(300%); } }
  </style>
  <script>
    (function() {
      var dots = 0;
      var el = document.getElementById('loader-text');
      if (el) {
        setInterval(function() {
          dots = (dots + 1) % 4;
          el.textContent = 'Initializing' + '.'.repeat(dots);
        }, 400);
      }
      window.addEventListener('load', function() {
        var loader = document.getElementById('initial-loader');
        if (loader) {
          loader.style.opacity = '0';
          setTimeout(function() { loader.style.display = 'none'; }, 400);
        }
      });
    })();
  </script>
</div>
  `;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
