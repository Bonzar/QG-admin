export default (response) => {
  if (!response) return;
  const reader = response.body.getReader();

  const stream = new ReadableStream({
    start(controller) {
      // The following function handles each data chunk
      function push() {
        // "done" is a Boolean and value a "Uint8Array"
        reader.read().then(({ done, value }) => {
          // If there is no more data to read
          if (done) {
            controller.close();
            return;
          }
          // Get the data and send it to the browser via the controller
          controller.enqueue(value);
          // Check chunks by logging to the console
          push();
        });
      }

      push();
    },
  });
  return {
    response,
    textBody: new Response(stream, {
      headers: { "Content-Type": "text/html" },
    }).text(),
  };
};
