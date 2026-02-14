OUTPUT_ARCH( "riscv" )
ENTRY( _start )

SECTIONS
{
  . = 0x80000000;      /* QEMU virtマシンのRAM開始地点 */
  .text : { *(.text) }
  .data : { *(.data) }
  .bss  : { *(.bss) }
  .stack : { *(.stack) }
}