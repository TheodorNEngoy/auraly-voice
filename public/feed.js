document.addEventListener("DOMContentLoaded", async function () {
  var app = document.getElementById("app");
  function esc(s){return (s||"").replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}

  app.innerHTML = '<section class="card"><p>Loading…</p></section>';

  try {
    var res = await fetch("/api/feed?limit=20", { cache:"no-store" });
    var data = await res.json();
    app.innerHTML = "";

    (data.items || []).forEach(function(it){
      var a = it.author || {};
      var avatar = a.image_url ? '<img src="'+esc(a.image_url)+'" alt="" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:.4rem">' : "";
      var authorHtml = a.name ? '<div class="row" style="display:flex;align-items:center;gap:.5rem;">'+avatar+'<span class="muted">'+esc(a.name)+'</span></div>' : "";

      var card = document.createElement("section");
      card.className = "card";

      var html = [
        "<h3>", esc(it.title || "Voice post"), "</h3>",
        authorHtml,
        '<audio controls src="', it.playback, '" style="width:100%"></audio>',
        '<p class="muted">', new Date(it.created_at).toLocaleString(), "</p>",
        '<p><a href="/p/', it.id, '" target="_blank" rel="noopener">Share link</a> · ',
        '<button class="x-trans" data-id="', it.id, '">Transcribe</button></p>',
        '<pre class="transcript">', esc(it.transcript || ""), "</pre>"
      ].join("");

      card.innerHTML = html;
      app.appendChild(card);
    });

    document.querySelectorAll(".x-trans").forEach(function(btn){
      btn.addEventListener("click", async function(){
        btn.disabled = true; btn.textContent = "Transcribing…";
        var id = btn.getAttribute("data-id");
        var r  = await fetch("/api/transcribe?id=" + encodeURIComponent(id), { method:"POST" });
        var j  = await r.json().catch(function(){ return {}; });
        var pre = btn.closest(".card").querySelector(".transcript");
        if (r.ok && j.text){ pre.textContent = j.text; btn.textContent = "Transcribed"; }
        else { pre.textContent = (j && j.error) ? JSON.stringify(j) : "Failed"; btn.disabled = false; btn.textContent = "Transcribe"; }
      });
    });

  } catch(e){
    app.innerHTML = '<section class="card"><p>Failed to load feed.</p></section>';
    console.error(e);
  }
});
