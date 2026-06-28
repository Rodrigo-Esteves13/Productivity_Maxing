# Producitivity Maxing

Gestor pessoal de prazos, avaliações e tempo de estudo, construído à medida de um único utilizador. Nasceu de uma folha de cálculo que controlava disciplinas, pesos de avaliações e notas alvo, e evoluiu para uma aplicação completa com login, sincronização com o Google Calendar e um sistema próprio de escalonamento de atrasos.

## Sobre o projeto

A ideia central é simples: em vez de gerir a faculdade entre um Excel, o Google Calendar e a memória, tudo passa a viver num único sítio que reflete a realidade do dia a dia. Cada avaliação tem uma disciplina associada, um peso, uma dificuldade, uma nota alvo e uma nota real, exatamente como na folha de cálculo original, mas agora com a lógica de cálculo no backend em vez de fórmulas espalhadas por colunas.

## Funcionalidades

O núcleo da aplicação é o dashboard de avaliações, que mostra as disciplinas com a sua cor própria e o estado de cada avaliação. Em vez de um simples pendente ou terminado, cada tarefa tem um campo de progresso com quatro níveis, adiantado, tempo esperado, atrasado e muito atrasado, calculado a partir da distância até à data de entrega e do estado atual.

A criação ou edição de uma avaliação sincroniza automaticamente com o Google Calendar do utilizador através de OAuth 2.0, guardando o identificador do evento para que futuras alterações atualizem o mesmo evento em vez de criarem duplicados.

Quando uma tarefa entra no nível muito atrasado, um agente local que corre no Windows do utilizador bloqueia o cliente da Riot Games até a tarefa ser marcada como concluída, através de polling periódico a uma rota de estado do backend.

A aplicação está pensada para funcionar como PWA, instalável a partir do Chrome no Android, sem necessidade de publicação em loja de aplicações.

## Stack técnica

Frontend em React, com Vite como ferramenta de build e Tailwind CSS para estilos. Backend em Node.js com Express, usando Sequelize como ORM sobre MySQL. Ambiente de desenvolvimento local com três contentores Docker, um para a base de dados, um para o backend e um para o frontend. Integração com a API do Google Calendar via OAuth 2.0.

## Estado do projeto

Em desenvolvimento ativo. O roadmap completo está dividido em fases, desde a estrutura da base de dados até ao deploy em produção, e pode ser consultado no ficheiro de planeamento do repositório.

## Como correr localmente

```bash
git clone https://github.com/<o-teu-utilizador>/producitivity-maxing.git
cd producitivity-maxing
cp .env.example .env
docker compose up
```

Depois de preencheres o `.env` com as credenciais da base de dados e do OAuth da Google, o frontend fica disponível em `http://localhost:5173` e o backend em `http://localhost:3000`.

## Variáveis de ambiente

As variáveis necessárias estão documentadas em `.env.example`. Nenhum valor real deve ser commitado, o `.gitignore` já exclui `.env` e `.env.local`.

## Segurança

Este repositório é público. Para reportar uma vulnerabilidade, segue as instruções em `SECURITY.md` em vez de abrir uma issue pública.

## Licença

Distribuído sob a licença MIT. Consulta o ficheiro `LICENSE` para o texto completo.
