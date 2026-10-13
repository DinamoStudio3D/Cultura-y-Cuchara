/* Coordinate images and bilingual audio without enabling Save while another upload runs. */
(function (root) {
  'use strict';
  const forms = new Map();
  function entry(id) {
    if (!forms.has(id)) {
      const form = document.getElementById(id), keys = new Set();
      if (!form) throw Error('No se encontró el formulario multimedia.');
      form.addEventListener('submit', event => {
        if (!keys.size) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
      forms.set(id, {form, keys, previous: new Map()});
    }
    return forms.get(id);
  }
  function begin(id, key) {
    const job = entry(id);
    if (!job.keys.size) {
      job.previous.clear();
      job.form.querySelectorAll('[type="submit"]').forEach(button => job.previous.set(button, button.disabled));
    }
    job.keys.add(key);
    job.previous.forEach((_state, button) => { button.disabled = true; });
  }
  function end(id, key) {
    const job = forms.get(id);
    if (!job) return;
    job.keys.delete(key);
    if (!job.keys.size) {
      job.previous.forEach((state, button) => { button.disabled = state; });
      job.previous.clear();
    }
  }
  root.VisitaLojaMediaGuard = {begin, end, pending: id => !!forms.get(id)?.keys.size};
})(window);
