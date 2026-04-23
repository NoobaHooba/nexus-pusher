function getConfig() {
  const parsedPort = Number.parseInt(process.env.PORT ?? '3001', 10);
  return {
    port: Number.isFinite(parsedPort) ? parsedPort : 3001,
  };
}

module.exports = {
  getConfig,
};
