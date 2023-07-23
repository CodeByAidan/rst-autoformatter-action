import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import { exec, ExecException } from "child_process";
import glob from "glob";

type CommandResult = { err: boolean; stdOut: string; stdErr: string };
type ExecOptions = { silent?: boolean };

const execute = (command: string, options: ExecOptions = {}): Promise<CommandResult> => {
  return new Promise<CommandResult>((resolve) => {
    exec(command, (error: ExecException | null, stdOut: string, stdErr: string) => {
      if (options.silent !== true) {
        console.log(stdOut);
        console.error(stdErr);
      }
      resolve({ err: error !== null, stdOut, stdErr });
    });
  });
};

const run = async (): Promise<void> => {
  const filesPattern: string = core.getInput("files") || "**/*.rst";
  const commitString: string = core.getInput("commit") || "true";
  const commit: boolean = commitString.toLowerCase() !== "false";
  const githubUsername: string = core.getInput("github-username") || "github-actions";
  const commitMessage: string = core.getInput("commit-message") || "Apply rstfmt formatting";

  await execute("sudo apt-get update", { silent: true });
  await execute("sudo apt-get install -y python3.10 python3-pip", { silent: true });
  await execute("pip3 install rstfmt==0.0.13", { silent: true });

  glob(filesPattern, async (err: Error | null, files: string[]) => {
    if (err) {
      core.setFailed(err.message);
      return;
    }

    core.debug(`Files to format: ${files.join(", ")}`);
    for (const file of files) {
      const tempFile: string = path.join(path.dirname(file), `temp-${path.basename(file)}`);
      const { stdErr }: CommandResult = await execute(`rstfmt "${file}" > "${tempFile}"`, { silent: true });
      if (stdErr) {
        core.setFailed(stdErr);
        return;
      }

      const original: string = fs.readFileSync(file, "utf8");
      const formatted: string = fs.readFileSync(tempFile, "utf8");

      if (original !== formatted) {
        fs.renameSync(tempFile, file);
        await execute(`git add "${file}"`);
      } else {
        fs.unlinkSync(tempFile);
      }
    }
  });

  if (commit) {
    await execute(`git config user.name "${githubUsername}"`, { silent: true });
    await execute("git config user.email '<>'", { silent: true });

    const { stdOut }: CommandResult = await execute("git status -s", { silent: true });

    if (stdOut.trim() === "") {
      core.info("No changes to commit. Skipping commit and push.");
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
