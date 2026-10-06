import "@testing-library/jest-dom/vitest";
import { MotionGlobalConfig } from "motion/react";

// As animações do motion terminam na hora: nenhum teste depende do tempo de entrada ou de saída.
MotionGlobalConfig.skipAnimations = true;
