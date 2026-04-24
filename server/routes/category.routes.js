import express from 'express';
// No ES6, precisamos colocar o .js no final do arquivo que estamos importando!
import * as categoriaController from '../controller/categoria.controller.js';

const router = express.Router();

// Definindo os endpoints da API
router.get('/', categoriaController.getCategorias);
router.post('/', categoriaController.createCategoria);
router.put('/:id', categoriaController.updateCategoria);
router.delete('/:id', categoriaController.deleteCategoria);

export default router;