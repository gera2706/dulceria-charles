document.addEventListener('DOMContentLoaded', () => {
  const form       = document.getElementById('contactForm');
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

    // Teléfono es opcional, pero si se llena debe tener un formato razonable
    // (solo dígitos/espacios/+/-, entre 7 y 15 caracteres).
    const telEl  = document.getElementById('telefono');
    const telErr = document.getElementById('error-telefono');
    if (telEl.value.trim() && !/^[\d\s+()-]{7,20}$/.test(telEl.value.trim())) {
      telErr.textContent = 'Ingresa un teléfono válido.';
      telEl.classList.add('invalid');
      ok = false;
    } else if (telErr) {
      telErr.textContent = '';
      telEl.classList.remove('invalid');
    }

    return ok;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault(); // evitamos recarga
    if (!validate()) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    // Antes esto mandaba el formulario a un formulario de Formspree de
    // un tercero (configurado con el correo de quien lo haya creado en
    // su momento, no necesariamente el del dueño). Ahora pasa por
    // nuestro propio backend y llega directo al correo de contacto
    // configurado en el panel admin — ver POST /api/config/contacto-mensaje.
    const datos = {
      nombre:   document.getElementById('nombre').value.trim(),
      email:    document.getElementById('email').value.trim(),
      telefono: document.getElementById('telefono').value.trim(),
      asunto:   document.getElementById('asunto').value,
      mensaje:  document.getElementById('mensaje').value.trim()
    };

    try {
      await apiEnviarContacto(datos);
      form.classList.add('hidden');
      successBox.classList.remove('hidden');
    } catch (err) {
      await dcAlert(err.message || 'No se pudo enviar el mensaje. Revisa tu conexión e intenta de nuevo.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  newMsgBtn.addEventListener('click', () => {
    form.reset();
    form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    form.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
    successBox.classList.add('hidden');
    form.classList.remove('hidden');

  });
  
});
