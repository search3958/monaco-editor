// RISC-V virtマシンのUART0アドレス
#define UART0_DR *((volatile unsigned char*)(0x10000000))

void k_print(char *s) {
    while (*s) {
        UART0_DR = *s++;
    }
}

void k_main() {
    k_print("----------------------------------\n");
    k_print("  Welcome to QEMU-WASM C-Kernel! \n");
    k_print("  Successfully running in Browser \n");
    k_print("----------------------------------\n");
    while (1) {
        // CPUをループさせて停止
    }
}