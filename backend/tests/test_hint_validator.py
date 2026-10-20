import pytest
from app.curriculum import PROJECT
from app.services.hint_validator import safe_hint

@pytest.mark.parametrize('text', [
    'Try this: ```js\nlist.appendChild(item);\n```',
    'Use `appendChild` to insert the item.',
    'const item = document.createElement("li");',
    '<label for="task">Task</label>',
    'Set input.value = "" after success.',
    'Use appendChild to solve this.',
    'Attach a click listener to the button.',
    'Append the created element to the task list.',
    'The solution is to clear the input after insertion.',
    '~~~html\n<input>\n~~~',
    'Try addTask(); in the handler.',
    'Reset the input value to an empty string.',
    'What result follows from count += 1?',
    'Try count++ before the next step.',
    'What does count + 1 produce?',
    'Declare const total before the click.',
    'Return true from the handler.',
    'Change line 12 to fix the behavior.',
    'Paste this line into the handler.',
    'Call addTask() when the button is selected.',
    'Set total = nextValue after the click.',
])
@pytest.mark.parametrize('level', [1, 2])
def test_code_and_direct_solution_leaks_rejected(text, level):
    assert not safe_hint(text, level)

def test_predefined_hints_are_safe():
    for m in PROJECT['milestones']:
        for level in [1, 2, 3]:
            assert safe_hint(m['hints'][level - 1], level)

def test_small_example_allowed_at_level_three():
    assert safe_hint('An example is `const count = 1;`.', 3)
    assert not safe_hint('short', 1)
