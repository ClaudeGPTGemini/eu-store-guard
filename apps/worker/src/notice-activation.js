// Browser source is literal: never serialize functions transformed by the Worker bundler.
export const activationScript = String.raw`// Read-only App Bridge observation, never evidence for a core LIVE state.
function noticeActivation(extensions, handle = 'guarantee-notice', target = 'body') {
  if (!Array.isArray(extensions)) return 'unknown';
  const matching = extensions.filter(e => e?.type === 'theme_app_extension' && e.handle === 'eu-store-guard');
  if (matching.length !== 1 || !Array.isArray(matching[0].activations)) return 'unknown';
  const blocks = matching[0].activations.filter(b => b?.handle === handle);
  if (blocks.length !== 1) return 'unknown';
  const block = blocks[0];
  if (block.target !== target || !Array.isArray(block.activations)) return 'unknown';
  if (block.status === 'unavailable') return 'unavailable';
  if (block.status === 'available' && block.activations.length === 0) return 'inactive';
  if (block.status !== 'active' || block.activations.length < 1) return 'unknown';
  if (target === 'section') {
    const placements = block.activations;
    return placements.every(p => typeof p?.target === 'string' && p.target.length > 0 && p.target.length <= 512 && p.target !== 'theme' && /^gid:\/\/shopify\/OnlineStoreTheme\/[1-9][0-9]*$/.test(p.themeId ?? '')) && new Set(placements.map(p => p.themeId)).size === 1 ? 'active' : 'unknown';
  }
  if (block.activations.length !== 1) return 'unknown';
  const placement = block.activations[0];
  return placement?.target === 'theme' && typeof placement.themeId === 'string' && /^gid:\/\/shopify\/OnlineStoreTheme\/[1-9][0-9]*$/.test(placement.themeId)
    ? 'active' : 'unknown';
}

function installActivationCheck(doc, bridge, classify) {
  const button = doc.querySelector('#check-activation');
  const output = doc.querySelector('#activation-result');
  if (!button || !output) return;
  const messages = {
    active: 'Shopify indica que el aviso está activado en el tema publicado. Esto no confirma que se muestre: siguen pendientes la comprobación del escaparate, la legibilidad y la accesibilidad.',
    inactive: 'El aviso no está activado en el tema publicado. Una activación en un tema borrador no aparece en esta consulta.',
    unavailable: 'Shopify indica que el aviso no está disponible en el tema publicado. Revisa la configuración de la extensión.',
    unknown: 'No se ha podido confirmar la activación en el tema publicado. La verificación de la tienda sigue pendiente.'
  };
  const check = async () => {
    button.disabled = true;
    output.textContent = 'Consultando el tema publicado…';
    let timer;
    output.dataset.esgActivationDiagnostic = 'pending';
    delete output.dataset.esgExtensionCount;
    delete output.dataset.esgHasThemeExtension;
    delete output.dataset.esgSectionActivation;
    delete output.dataset.esgLegacyEmbedActivation;
    try {
      if (typeof bridge?.app?.extensions !== 'function') { output.dataset.esgActivationDiagnostic = 'api_unavailable'; throw Error('API_UNAVAILABLE'); }
      const extensions = await Promise.race([
        bridge.app.extensions(),
        new Promise((_, reject) => { timer = setTimeout(() => { output.dataset.esgActivationDiagnostic = 'timeout'; reject(Error('TIMEOUT')); }, 10000); })
      ]);
      const sectionState = classify(extensions, 'guarantee-notice-header', 'section');
      const embedState = classify(extensions);
      output.dataset.esgSectionActivation = sectionState;
      output.dataset.esgLegacyEmbedActivation = embedState;
      output.textContent = sectionState === 'active'
        ? 'Shopify detecta el bloque de sección en el tema publicado. Aún no hemos confirmado que el aviso se muestre ni su ubicación, cobertura o accesibilidad.'
        : 'Aún no hemos confirmado que el aviso se muestre. Añade Aviso garantía (Header) al grupo Header. Esta consulta no comprueba los temas borrador.';
      if (embedState === 'active') output.textContent += ' También se detecta el embed anterior: completa la migración al bloque de sección.';
      // Fixed, non-sensitive diagnostics for DEV inspection. Never include raw API data.
      if (Array.isArray(extensions)) {
        output.dataset.esgExtensionCount = String(extensions.length);
        output.dataset.esgHasThemeExtension = String(extensions.some(e => e?.type === 'theme_app_extension'));
      }
      const matching = Array.isArray(extensions) ? extensions.filter(e => e?.type === 'theme_app_extension' && e.handle === 'eu-store-guard') : [];
      const blocks = matching.length === 1 && Array.isArray(matching[0].activations) ? matching[0].activations.filter(b => b?.handle === 'guarantee-notice-header') : [];
      output.dataset.esgActivationDiagnostic = !Array.isArray(extensions) ? 'invalid_response' : extensions.length === 0 ? 'extensions_empty' : matching.length === 0 ? 'handle_or_type_mismatch' : matching.length !== 1 ? 'extension_ambiguous' : blocks.length === 0 ? 'block_absent' : blocks.length !== 1 ? 'block_ambiguous' : sectionState === 'unknown' ? 'unexpected_placement' : 'classified';
    } catch {
      if (output.dataset.esgActivationDiagnostic === 'pending') output.dataset.esgActivationDiagnostic = 'api_failed';
      output.textContent = messages.unknown;
    } finally {
      clearTimeout(timer);
      button.disabled = false;
    }
  };
  button.addEventListener('click', check);
  return check;
}

installActivationCheck(document,globalThis.shopify,noticeActivation);`;
