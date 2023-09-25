-- disable Employment Hero integration
UPDATE res_company
   SET l10n_eh_enable = false,
       l10n_eh_identifier = '',
       l10n_eh_api_key = '';
