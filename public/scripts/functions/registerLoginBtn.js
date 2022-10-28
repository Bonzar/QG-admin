const username = localStorage.getItem("username");

if (username) {
  const loginBtn = document.getElementById("loginBtn");

  loginBtn.textContent = username;
  loginBtn["href"] = "#";

  loginBtn.addEventListener("click", () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    window.location.href = "/";
  });
}
