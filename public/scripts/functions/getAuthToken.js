export default () => {
  const authToken = localStorage.getItem("authToken");
  const authTokenExpires = localStorage.getItem("authTokenExpires");
  if (!(Date.now() < authTokenExpires && authToken)) {
    alert(
      "Токен доступа не указан или его срок жизни истек. Необходима повторная авторизация."
    );
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    localStorage.removeItem("authTokenExpires");
    return (window.location.href = "/auth/login");
  }

  return authToken;
};
