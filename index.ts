import * as core from "@actions/core";
import { ExecOptions } from "@actions/exec";
import { exec as cpExec } from "child_process";

interface ExecuteReturn {
	err: boolean;
	stdOut: string;
	stdErr: string;
}

const execute = async (
	command: string,
	options: ExecOptions & { listeners?: any; shell?: string } = {}
): Promise<ExecuteReturn> => {
	let stdOut = "";
	let stdErr = "";

	const execOptions: ExecOptions & { listeners?: any; shell?: string } = {
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
		shell: options.shell || "/bin/bash",
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
    const commands = `
    sudo apt-get update
    sudo apt-get install -y python3.10
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    for file in tests/*.rst README.rst; do
      rstfmt "$file"
      cp "$file" "temp-$file"
      if ! cmp -s "$file" "temp-$file"; then
        mv "temp-$file" "$file"
      fi
      rm -f "temp-$file"
    done
    git config user.name "GitHub Actions"
    git config user.email "<>"
    if [ -n "$(git status -s)" ]; then
      git add .
      git commit -m "Apply rstfmt formatting"
      git push
    else
      echo "No changes to commit. Skipping commit and push."
    fi
    `;
    await execute(commands);
};

run().catch((error: Error) => core.setFailed(error.message));
