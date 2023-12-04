##########################
 RST AutoFormatter Action
##########################

A GitHub Action that automatically formats reStructuredText (rst) files
in your project using ``rstfmt`` every time you make a push or a pull
request. This is done through a little bit of magic with glob patterns,
and Unix commands!

*******
 Usage
*******

**Check if "Read and write permissions" are enabled in Settings ->
Actions -> General -> Workflow permissions:**

.. image:: https://raw.githubusercontent.com/livxy/rst-autoformatter-action/27b2b96a1b1484d4f12b15f2f6d924aba85ade2c/media/chrome_pAkjeMG4hV.png

To use this action, you need to create a workflow (``.yml`` or ``.yaml``
file) in the ``.github/workflows`` directory of your repository. and add
the following code to it:

.. code:: yaml

   name: RST Autoformatter

   on: [push, pull_request]

   jobs:
     formatting:
       runs-on: ubuntu-latest
       steps:
         - name: Check out code
           uses: actions/checkout@v3

         - name: Set up Python
           uses: actions/setup-python@v4
           with:
             python-version: '3.10'

         - name: Run RST Autoformatter
           uses: CodeByAidan/rst-autoformatter-action@main
           with:
             # files: '**/*.rst' # works! - globbing is supported
             # files: 'tests/*.rst' # works! - just another glob pattern
             # files: 'tests/lines.rst' # works! - single file
             # files: '{tests/admonitions,tests/escaped-text}.rst' # works! - brace expansion is supported (Unix trick)
             # For more patterns, see https://mywiki.wooledge.org/glob#Globs
             files: '**/*.rst'
             commit: 'true'
             github-username: 'github-actions'
             commit-message: 'Automated RST formatting'

*********
 License
*********

``rst-autoformatter-action`` is licensed under ``MIT``. See the `LICENSE
</LICENSE>`_ file for more information.
