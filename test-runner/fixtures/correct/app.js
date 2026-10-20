const input = document.querySelector('input');
const button = document.querySelector('button');
const list = document.querySelector('ul');

function addTask() {
  const text = input.value.trim();
  if (!text) return;
  const item = document.createElement('li');
  item.textContent = text;
  list.appendChild(item);
  input.value = '';
}

button.addEventListener('click', addTask);
