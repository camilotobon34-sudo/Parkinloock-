import * as auth from '../services/auth.service.js'

export const login = async (req, res) => res.json(await auth.login(req.body))
export const me = async (req, res) => res.json(await auth.perfil(req.usuario))
