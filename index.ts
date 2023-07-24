import * as core from "@actions/core";
import { exec, ExecOptions } from "@actions/exec";
import { writeFileSync } from "fs";
import glob from "glob";

const findFilesWithGlob = (filePattern: string): Promise<string[]> => {
	return new Promise<string[]>((resolve, reject) => {
		glob(filePattern, (error, files) => {
			if (error) {
				reject(error);
			} else {
				resolve(files);
			}
		});
	});
};

const execute = async (
	command: string,
	{ silent = false } = {}
): Promise<{ err: boolean; stdOut: string; stdErr: string }> => {
	let stdOut = "";
	let stdErr = "";
	const options: ExecOptions = {
		silent,
		ignoreReturnCode: true,
		listeners: {
			stdout: (data: Buffer) => (stdOut += data.toString()),
			stderr: (data: Buffer) => (stdErr += data.toString()),
		},
	};

	const exitCode = await exec(command, undefined, options);

	return { err: exitCode !== 0, stdErr, stdOut };
};

const push = async () => execute("git push");

const main = async () => {
	const DEBUG = core.isDebug();
	const args = core.getInput("rstfmt-args") || "";
	const filePatterns = core.getMultilineInput("files") || ["**/*.rst"];

	const commitString = core.getInput("commit") || "true";
	const commit = commitString.toLowerCase() !== "false";

	const githubUsername = core.getInput("github-username") || "github-actions";

	const commitMessage = core.getInput("commit-message") || "Format RST files";

	await core.group("Installing rstfmt", async () => {
		await execute("pip install rstfmt", { silent: true });
	});

	if (DEBUG) {
		// If needed, write your unformatted RST content to a file here
	}

	let rstFiles: string[] = [];
	for (const filePattern of filePatterns) {
		const files = await findFilesWithGlob(filePattern);
		rstFiles = rstFiles.concat(files);
	}

	if (rstFiles.length === 0) {
		core.info("No RST files found.");
		return;
	}

	const individualFiles = rstFiles.join("\n").split("\n");

	const formatCommands = individualFiles.map((file) => `rstfmt ${file}`);
	core.info(`Current working directory: ${process.cwd()}`);
	core.info(`Formatting RST files: ${individualFiles.join(", ")}`);
	core.info(`Format command: ${formatCommands.join(", ")}`);
	const formatResult = await Promise.all(
		formatCommands.map((command) => execute(command))
	);

	const failedFiles = formatResult
		.filter((result) => result.err)
		.map((result, index) => {
			const cmdIndex = formatResult.findIndex((r) => r === result);
			const failedFile = individualFiles[cmdIndex];
			core.error(`Error formatting RST file: ${failedFile}`);
			core.error(`Error message: ${result.stdErr}`);
			return failedFile;
		});

	if (failedFiles.length > 0) {
		core.error(`Error formatting RST files: ${failedFiles.join(", ")}`);
		core.setFailed("Error formatting RST files.");
		return;
	}

	core.info("RST files formatted successfully.");

	if (commit) {
		await core.group("Committing changes", async () => {
			await execute(`git config user.name "${githubUsername}"`, {
				silent: true,
			});
			await execute('git config user.email ""', { silent: true });
			const { err: diffErr } = await execute("git diff-index --quiet HEAD", {
				silent: true,
			});
			if (!diffErr) {
				core.info("Nothing to commit!");
			} else {
				await execute(`git commit --all -m "${commitMessage}"`);
				await push();
			}
		});
	}
};

try {
	main();
} catch (err: unknown) {
	if (err instanceof Error) {
		core.setFailed(err.message);
	} else {
		core.setFailed("An error occurred.");
	}
}
