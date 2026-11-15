import { createContext } from 'react';
import type { QuizDiagram } from './quizDiagram';

// Diagramas do quiz aberto (id -> dados do diagrama). O QuizDetail fornece-os e o
// enunciado de cada pergunta mostra o seu, sem passar props por todo o lado.
export const QuizFiguresContext = createContext<Record<string, QuizDiagram>>({});
