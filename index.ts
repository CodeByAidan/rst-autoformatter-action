import * as core from "@actions/core";
import { exec, ExecOptions } from "@actions/exec";
import glob from "glob";

/**
 * Find files using a glob pattern.
 * @param filePattern The glob pattern to search for files.
 * @returns A promise that resolves with an array of file paths matching the pattern.
 */
const findFilesWithGlob = (filePattern: string): Promise<string[]> => {
	return new Promise<string[]>((resolve, reject) => {
		glob(filePattern, (error: Error | null, files: string[]) => {
			if (error) {
				reject(error);
			} else {
				resolve(files);
			}
		});
	});
};

/**
 * Execute a command asynchronously.
 * @param command The command to execute.
 * @param options Optional configuration options for the execution.
 * @returns A promise that resolves with the execution result.
 */
const execute = async (
	command: string,
	{ silent = false }: { silent?: boolean } = {}
): Promise<{ err: boolean; stdOut: string; stdErr: string }> => {
	let stdOut: string = "";
	let stdErr: string = "";
	const options: ExecOptions = {
		silent,
		ignoreReturnCode: true,
		listeners: {
			stdout: (data: Buffer) => (stdOut += data.toString()),
			stderr: (data: Buffer) => (stdErr += data.toString()),
		},
	};

	const exitCode: number = await exec(command, undefined, options);

	return { err: exitCode !== 0, stdErr, stdOut };
};

/**
 * Execute a `git push`.
 */
const push = async (): Promise<void> => {await execute("git push")};

/**
 * Main function that formats RST files based on the provided configuration.
 */
const main = async (): Promise<void> => {
	const DEBUG: boolean = core.isDebug();
	const args: string = core.getInput("rstfmt-args") || "";
	const filePatterns: string[] = core.getMultilineInput("files") || ["**/*.rst"];

	const commitString: string = core.getInput("commit") || "true";
	const commit: boolean = commitString.toLowerCase() !== "false";

	const githubUsername: string = core.getInput("github-username") || "github-actions";

	const commitMessage: string = core.getInput("commit-message") || "Format RST files";

	await core.group("Installing rstfmt", async (): Promise<void> => {
		await execute("pip install rstfmt", { silent: true });
	});

	if (DEBUG) {
		// If needed, write your unformatted RST content to a file here
	}

	let rstFiles: string[] = [];
	for (const filePattern of filePatterns) {
		const files: string[] = await findFilesWithGlob(filePattern);
		rstFiles = rstFiles.concat(files);
	}

	if (rstFiles.length === 0) {
		core.info("No RST files found.");
		return;
	}

	const individualFiles: string[] = rstFiles.join("\n").split("\n");

	const formatCommands: string[] = individualFiles.map((file) => `rstfmt ${file}`);
	core.info(`Current working directory: ${process.cwd()}`);
	core.info(`Formatting RST files: ${individualFiles.join(", ")}`);
	core.info(`Format command: ${formatCommands.join(", ")}`);
	const formatResult: { err: boolean; stdOut: string; stdErr: string }[] = await Promise.all(
		formatCommands.map((command) => execute(command))
	);

	const failedFiles: string[] = formatResult
		.filter((result) => result.err)
		.map((result, index) => {
			const cmdIndex: number = formatResult.findIndex((r) => r === result);
			const failedFile: string = individualFiles[cmdIndex];
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
		await core.group("Committing changes", async (): Promise<void> => {
			await execute(`git config user.name "${githubUsername}"`, {
				silent: true,
			});
			await execute('git config user.email ""', { silent: true });
			const { err: diffErr }: { err: boolean } = await execute("git diff-index --quiet HEAD", {
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
