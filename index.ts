import * as core from "@actions/core";
import * as fs from "fs";
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
	await execute("pip install rstfmt==0.0.13", { silent: true });

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
			for (const file of files) {
				await execute(`rstfmt "${file}"`, { silent: true });
			}
		}
	});

	if (commit) {
		await execute(`git config user.name "${githubUsername}"`, { silent: true });
		await execute("git config user.email ''", { silent: true });

		const { err } = await execute("git diff-index --quiet HEAD", {
			silent: true,
		});

		if (!err) {
			core.info("Nothing to commit!");
		} else {
			await execute(`git commit --all -m "${commitMessage}"`);
			await execute("git push", { silent: true });
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
