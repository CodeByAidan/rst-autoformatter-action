# RST AutoFormatter Action

This repository hosts a GitHub Action that automatically formats reStructuredText (rst) files in your project using `rstfmt` every time you make a push or a pull request.

## Usage

To use this action, you need to create a workflow (`.yml` or `.yaml` file) in the `.github/workflows` directory of your repository. Here's a simple example of what your workflow might look like:

```yaml
name: Format RST files

on: [push, pull_request]

jobs:
  format:
    runs-on: ubuntu-latest
    steps:
    - name: Check out code
      uses: actions/checkout@v2
      
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.x'
        
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        
    - name: Format RST files
      run: |
        rstfmt -i README.rst
