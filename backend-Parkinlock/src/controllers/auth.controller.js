import * as auth from '../services/auth.service.js'

export const login = async (req, res) => res.json(await auth.login(req.body))
export const cliente = async (req, res) => res.json(await auth.ingresarCliente(req.body))
export const registrarCliente = async (req, res) => res.status(201).json(await auth.registrarCliente(req.body))
export const me = async (req, res) => res.json(await auth.perfil(req.usuario))
