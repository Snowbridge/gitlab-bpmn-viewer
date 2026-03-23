document.addEventListener("gl-bpmn-diff-apply", function (e) {
  var d = e.detail;
  if (!d || d.fileVersionHead === undefined || d.fileVersionBase === undefined) return;
  function run() {
    if (window.APP) {
      window.APP.loadSource("right", { xml: d.fileVersionHead });
      window.APP.loadSource("left", { xml: d.fileVersionBase });
      return;
    }
    setTimeout(run, 50);
  }
  run();
});
