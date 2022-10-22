export const addLoading = (targetBlock) => {
  const loadingIcon = document.querySelector(".tea-loading--icon");
  const loadingBlock = document.createElement("div");
  loadingBlock.innerHTML = loadingIcon.outerHTML;
  targetBlock.appendChild(loadingBlock);
  targetBlock.classList.add("loading");

  return () => {
    targetBlock.removeChild(loadingBlock);
    targetBlock.classList.remove("loading");
  };
};
