.section .text
.global _start
_start:
    la sp, stack_top    # スタックポインタを設定
    call k_main         # C言語のメイン関数へ
loop:
    j loop

.section .stack
stack_low:
    .skip 1024          # 1KBのスタック領域
stack_top: