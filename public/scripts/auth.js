// const loginButton = document.getElementById("YandexLogin");
//
// loginButton.setAttribute("disabled", "disabled");
//
// let access_token = localStorage.getItem("yandex_access_token");
//
// if (access_token) {
//   location.href = `/projects/yandex?access_token=${access_token}`;
// } else {
//   const urlParams = new URLSearchParams(window.location.hash.slice(1));
//   access_token = urlParams.get("access_token");
//   if (access_token) {
//     localStorage.setItem("yandex_access_token", access_token);
//     location.href = `/projects/yandex?access_token=${access_token}`;
//   }
// }
//
// loginButton.removeAttribute("disabled");
