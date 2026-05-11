const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '20mb' }));

// Proxy seguro para a API da Anthropic
app.post('/api/formatar-cv', async (req, res) => {
  const { pdfBase64, vaga } = req.body;

  if (!pdfBase64 || !vaga) {
    return res.status(400).json({ error: 'PDF e vaga são obrigatórios.' });
  }

  const prompt = `Você é um assistente da consultoria de recrutamento StartRH. Recebi o currículo de um candidato em PDF. Extraia e organize as informações no formato JSON abaixo. Se alguma informação não existir, use string vazia ou array vazio.

Retorne APENAS o JSON, sem nenhum texto antes ou depois, sem markdown, sem explicações:

{
  "nome": "",
  "cargoAtual": "",
  "email": "",
  "telefone": "",
  "cidade": "",
  "linkedin": "",
  "resumo": "",
  "experiencias": [{"cargo": "","empresa": "","periodo": "","descricao": ""}],
  "formacao": [{"curso": "","instituicao": "","periodo": ""}],
  "idiomas": [""],
  "habilidades": [""],
  "cursos": [""]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erro na API Anthropic' });
    }

    const rawText = data.content.find(b => b.type === 'text')?.text || '';
    const jsonStr = rawText.replace(/```json|```/g, '').trim();
    const cv = JSON.parse(jsonStr);

    res.json({ cv });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno ao processar o CV.' });
  }
});

// Servir arquivos estáticos APÓS as rotas da API
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StartRH CV rodando na porta ${PORT}`));
