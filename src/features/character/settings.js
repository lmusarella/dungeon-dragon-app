import { getState, setState } from '../../app/state.js';
import { supabase } from '../../lib/supabase.js';
import { createToast } from '../../ui/components.js';

export async function renderSettings(container) {
  const { characters, activeCharacterId } = getState();
  const active = characters.find((char) => char.id === activeCharacterId);
  if (!active) {
    container.innerHTML = '<section class="card"><p>Nessun personaggio selezionato.</p></section>';
    return;
  }

  const settings = active.data?.settings || { encumbrance: 'standard', weight_unit: 'lb' };

  container.innerHTML = `
    <section class="card">
      <h2>Impostazioni</h2>
      <form data-settings-form>
        <label class="field">
          <span>Modalità ingombro</span>
          <select name="encumbrance">
            <option value="standard">Standard</option>
            <option value="variant">Variant</option>
          </select>
        </label>
        <label class="field">
          <span>Mostra peso in</span>
          <select name="weight_unit">
            <option value="lb">Lb</option>
            <option value="kg">Kg</option>
          </select>
        </label>
        <button class="primary" type="submit">Salva</button>
      </form>
    </section>
  `;

  const form = container.querySelector('[data-settings-form]');
  form.encumbrance.value = settings.encumbrance;
  form.weight_unit.value = settings.weight_unit;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const nextSettings = {
      encumbrance: formData.get('encumbrance'),
      weight_unit: formData.get('weight_unit')
    };

    try {
      const updatedData = { ...active.data, settings: nextSettings };
      const { data, error } = await supabase
        .from('characters')
        .update({ data: updatedData })
        .eq('id', active.id)
        .select('*')
        .single();
      if (error) throw error;
      const updated = characters.map((char) => (char.id === active.id ? data : char));
      setState({ characters: updated });
      createToast('Impostazioni salvate');
    } catch (error) {
      createToast('Errore salvataggio impostazioni', 'error');
    }
  });
}
