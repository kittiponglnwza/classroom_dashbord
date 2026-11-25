import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Prevent 1000ms waitFor/findBy flakes on 2-vCPU CI runners under v8 coverage load
configure({ asyncUtilTimeout: 5000 });
