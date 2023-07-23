import * as core from "@actions/core";
import { ExecOptions } from "@actions/exec";
import { exec as cpExec } from 'child_process';
import * as fs from "fs";
import * as glob from "glob";

const execute = async (command: string, options: ExecOptions & { listeners?: any, shell?: string } = {}): Promise<ExecuteReturn> => {
	let stdOut = "";
	let stdErr = "";

	const execOptions: ExecOptions & { listeners?: any, shell?: string } = {
		...options,
		listeners: {
			stdout: (data: Buffer) => {
				stdOut += data.toString();
			},
			stderr: (data: Buffer) => {
				stdErr += data.toString();
			},
			...options.listeners,
		},
		shell: options.shell || '/bin/bash',
	};

	return new Promise((resolve, reject) => {
		cpExec(command, { shell: execOptions.shell }, (error, stdout, stderr) => {
			if (error) {
				console.error(`exec error: ${error}`);
				resolve({ err: true, stdOut: stdout, stdErr: stderr });
			}
			resolve({ err: false, stdOut: stdout, stdErr: stderr });
		});
	});
};

const run = async () => {
	const filesPattern: string = core.getInput("files") || "**/*.rst";
	const commitString: string = core.getInput("commit") || "true";
	const commit: boolean = commitString.toLowerCase() !== "false";
	const githubUsername: string = core.getInput("github-username") || "github-actions";
	const commitMessage: string = core.getInput("commit-message") || "Apply rstfmt formatting";

	await execute("sudo apt-get update", { silent: false });
	await execute("sudo apt-get install -y python3.10 python3-pip", { silent: false });
	await execute("pip3 install rstfmt", { silent: false });

	const files: string[] = glob.sync(filesPattern);
	core.debug(`Files to format: ${files.join(", ")}`);

	for (const file of files) {
		const original: string = fs.readFileSync(file, "utf-8");
		const tmpFile: string = `${file}.tmp`;

		await execute(`rstfmt "${file}" > "${file}"`, { silent: false, ...{ shell: '/bin/bash' } });

		const formatted: string = fs.readFileSync(tmpFile, "utf-8");
		fs.unlinkSync(tmpFile);

		fs.writeFileSync(file, formatted, "utf-8");

		if (original !== formatted && commit) {
			await execute(`git add "${file}"`);
		}
	}


	if (commit) {
		await execute(`git config user.name "${githubUsername}"`, { silent: false });
		await execute("git config user.email ''", { silent: false });

		const { stdOut } = await execute("git status --porcelain", { silent: false });
		if (stdOut.trim() !== "") {
			await execute(`git commit --all -m "${commitMessage}"`);
			await execute("git push", { silent: false });
		} else {
			core.info("Nothing to commit!");
		}
	}
};

run().catch((error: Error) => core.setFailed(error.message));
