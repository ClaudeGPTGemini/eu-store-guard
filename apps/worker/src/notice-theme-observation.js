// Read-only DEV inspection. Observations are never approved reviews or publication evidence.
export async function observePublishedTheme(client, now = new Date()) {
  const connection = await client.readPublishedTheme();
  const diagnostics = {
    themeCount: Array.isArray(connection?.nodes) ? connection.nodes.length : null,
    themesComplete: connection?.pageInfo?.hasNextPage === false,
    observedAt: now.toISOString(), reviewed: false, publicVerification: 'pending'
  };
  if (!diagnostics.themesComplete || diagnostics.themeCount !== 1) return {...diagnostics, reason: 'published_theme_unknown'};
  const theme = connection.nodes[0];
  if (!/^gid:\/\/shopify\/OnlineStoreTheme\/[1-9][0-9]*$/.test(theme?.id ?? '') ||
      theme.role !== 'MAIN' || theme.processing !== false || theme.processingFailed !== false ||
      typeof theme.updatedAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(theme.updatedAt) ||
      !Number.isFinite(Date.parse(theme.updatedAt)) || Date.parse(theme.updatedAt) > now.getTime()) {
    return {...diagnostics, reason: 'published_theme_unknown'};
  }
  diagnostics.themeId = theme.id.split('/').at(-1);
  diagnostics.updatedAt = theme.updatedAt;
  const files = theme.files;
  diagnostics.fileCount = Array.isArray(files?.nodes) ? files.nodes.length : null;
  diagnostics.filesComplete = files?.pageInfo?.hasNextPage === false;
  const file = files?.nodes?.[0];
  if (!diagnostics.filesComplete || diagnostics.fileCount !== 1 || file?.filename !== 'sections/header-group.json' || typeof file.body?.content !== 'string') {
    return {...diagnostics, reason: 'header_file_unknown'};
  }
  const bytes = new TextEncoder().encode(file.body.content);
  if (bytes.length > 1048576) return {...diagnostics, reason: 'header_file_unknown'};
  diagnostics.filename = file.filename;
  diagnostics.headerSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  return {...diagnostics, reason: 'observation_only'};
}
