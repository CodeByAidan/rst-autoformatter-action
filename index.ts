import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import { exec, ExecOptions } from "@actions/exec";

const execute = async (
  command: string,
  options: ExecOptions & { silent?: boolean } = {}
) => {
  let stdOut = "";
  let stdErr = "";

  const execOptions: ExecOptions = {
    ...options,
    listeners: {
      stdout: (data: Buffer) => {
        stdOut += data.toString();
      },
      stderr: (data: Buffer) => {
        stdErr += data.toString();
      },
    },
  };

  const exitCode = await exec(command, undefined, execOptions);

  return { err: exitCode !== 0, stdErr, stdOut };
};

const run = async () => {
  await execute("sudo apt-get update", { silent: true });
  await execute("sudo apt-get install -y python3.10 python3-pip", {
    silent: true,
  });
  await execute("pip3 install rstfmt==0.0.13", { silent: true });

  const filesPattern = core.getInput("files") || "**/*.rst";

  const commitString = core.getInput("commit") || "true";
  const commit = commitString.toLowerCase() !== "false";

  const githubUsername = core.getInput("github-username") || "github-actions";

  const commitMessage = core.getInput("commit-message") || "Format Java";

  const glob = require("glob");
  glob(filesPattern, async (err: Error, files: string[]) => {
    if (err) {
      core.setFailed(err.message);
    } else {
      core.debug(`Files to format: ${files.join(", ")}`);
      const formatPromises = files.map((file) =>
        execute(`rstfmt "${file}" > "temp-${file}"`, { silent: false })
      );
      const results = await Promise.all(formatPromises);

      for (const result of results) {
        if (result.err) {
          core.setFailed(result.stdOut);
        }
      }

      for (const file of files) {
        const tempFile = `temp-${file}`;
        const original = fs.readFileSync(file);
        const formatted = fs.readFileSync(tempFile);

        if (!original.equals(formatted)) {
          fs.copyFileSync(tempFile, file);
          await execute(`git add "${file}"`);
        }

        fs.unlinkSync(tempFile);
      }
    }
  });

  if (commit) {
    await execute(`git config user.name "${githubUsername}"`, { silent: true });
    await execute("git config user.email ''", { silent: true });

    const { stdOut } = await execute("git status --porcelain", {
      silent: true,
    });

    if (stdOut.trim() === "") {
      core.info("Nothing to commit!");
    } else {
      try {
        await execute(`git commit -m "${commitMessage}"`);
        await execute("git push", { silent: true });
      } catch (err: unknown) {
        if (err instanceof Error) {
          core.setFailed(err.message);
        } else {
          core.setFailed("An error occurred.");
        }
      }
    }
  }
};

try {
  run();
} catch (err: unknown) {
  if (err instanceof Error) {
    core.setFailed(err.message);
  } else {
    core.setFailed("An error occurred.");
  }
}