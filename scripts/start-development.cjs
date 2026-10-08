const { spawn } = require("node:child_process");

const cli = require.resolve("expo/bin/cli");
const child = spawn(process.execPath, [cli, "start", "--dev-client", "--scheme", "yearbookapp-dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, APP_VARIANT: "development" },
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
