"""Package marker for backend tests.

Having this file makes the ``tests`` directory a Python package so that
test modules under it can be imported. Note that ``backend.tests`` is only
importable if ``backend`` itself is a Python package (i.e., has
``backend/__init__.py``). Historically this directory contained only a
``.gitkeep`` file, which is no longer needed.
"""
