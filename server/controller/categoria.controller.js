import prisma from '../lib/prisma.js'; // Importando o Prisma do jeito ES6 (com o .js)

// LER (Retorna todas as categorias)
export const getCategorias = async (req, res) => {
  try {
    const categorias = await prisma.categorias.findMany({
      orderBy: { id_categoria: 'desc' }
    });
    res.status(200).json(categorias);
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    res.status(500).json({ error: 'Erro interno ao buscar categorias.' });
  }
};

// CRIAR (Adiciona uma nova categoria)
export const createCategoria = async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    
    const novaCategoria = await prisma.categorias.create({
      data: { 
        nome, 
        descricao 
      }
    });
    res.status(201).json(novaCategoria);
  } catch (error) {
    console.error("Erro ao criar categoria:", error);
    res.status(500).json({ error: 'Erro ao criar a categoria.' });
  }
};

// ATUALIZAR (Edita uma categoria existente)
export const updateCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao } = req.body;

    const categoriaAtualizada = await prisma.categorias.update({
      where: { id_categoria: parseInt(id) },
      data: { nome, descricao }
    });
    res.status(200).json(categoriaAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar categoria:", error);
    res.status(500).json({ error: 'Erro ao atualizar a categoria.' });
  }
};

// DELETAR (Remove uma categoria)
export const deleteCategoria = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.categorias.delete({
      where: { id_categoria: parseInt(id) }
    });
    res.status(200).json({ message: 'Categoria deletada com sucesso.' });
  } catch (error) {
    console.error("Erro ao deletar categoria:", error);
    res.status(500).json({ error: 'Erro ao deletar a categoria. Ela pode estar vinculada a produtos.' });
  }
};