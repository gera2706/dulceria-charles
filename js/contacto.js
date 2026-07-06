document.addEventListener('DOMContentLoaded', () => {
  const form       = document.getElementById('contact-form');
  const successBox = document.getElementById('form-success');
  const newMsgBtn  = document.getElementById('new-msg-btn');

  function validate() {
    let ok = true;

    const fields = [
      { id: 'nombre',  errId: 'error-nombre',  msg: 'El nombre es obligatorio.' },
      { id: 'email',   errId: 'error-email',   msg: 'El correo es obligatorio.' },
      { id: 'asunto',  errId: 'error-asunto',  msg: 'Selecciona un asunto.' },
      { id: 'mensaje', errId: 'error-mensaje', msg: 'El mensaje es obligatorio.' },
    ];

    fields.forEach(({ id, errId, msg }) => {
      const el  = document.getElementById(id);
      const err = document.getElementById(errId);
      if (!el.value.trim()) {
        err.textContent = msg;
        el.classList.add('invalid');
        ok = false;
      } else {
        err.textContent = '';
        el.classList.remove('invalid');
      }
    });

    const emailEl  = document.getElementById('email');
    const emailErr = document.getElementById('error-email');
    if (emailEl.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
      emailErr.textContent = 'Ingresa un correo válido.';
      emailEl.classList.add('invalid');
      ok = false;
    }

    return ok;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;
    form.classList.add('hidden');
    successBox.classList.remove('hidden');
  });

  newMsgBtn.addEventListener('click', () => {
    form.reset();
    form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    form.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
    successBox.classList.add('hidden');
    form.classList.remove('hidden');
  });
});
