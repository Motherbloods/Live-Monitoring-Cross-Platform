import { createAccount, patchAccount, removeAccount } from '../services/mockAccountsService.js'

export const accountsApi = {
  create: (form, username) => createAccount(form, username),
  update: (patch) => patchAccount(patch),
  remove: (id) => removeAccount(id)
}
