document.addEventListener("DOMContentLoaded", async () => {
  const nav = document.querySelector("header nav");
  const box = document.createElement("span");
  box.id = "authbox";
  nav.appendChild(box);

  let user = null;
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (res.ok) user = await res.json();
  } catch {}

  window.__user = user;

  if (user) {
    box.innerHTML =
      `<img src="${user.image_url||''}" alt="" class="avatar">` +
      `${(user.name||'You')} · <button id="logoutBtn" type="button">Sign out</button>`;
    document.getElementById("logoutBtn").onclick = async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      location.href = "/signin.html";
    };
  } else {
    box.innerHTML = `<a href="/signin.html">Sign in</a>`;
  }

  document.dispatchEvent(new Event("auth:ready"));
});

