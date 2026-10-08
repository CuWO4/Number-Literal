#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <string>

int main() {
  std::string line;
  while (std::getline(std::cin, line)) {
    if (line.empty()) continue;
    double d = strtod(line.c_str(), nullptr);
    float f = strtof(line.c_str(), nullptr);
    char b1[512], b2[512], b3[512], b4[512], b5[512], b6[512];
    std::snprintf(b1, sizeof b1, "%f", d);
    std::snprintf(b2, sizeof b2, "%E", d);
    std::snprintf(b3, sizeof b3, "%a", d);
    std::snprintf(b4, sizeof b4, "%f", static_cast<double>(f));
    std::snprintf(b5, sizeof b5, "%E", static_cast<double>(f));
    std::snprintf(b6, sizeof b6, "%a", static_cast<double>(f));
    std::cout << line << '\t' << b1 << '\t' << b2 << '\t' << b3
              << '\t' << b4 << '\t' << b5 << '\t' << b6 << '\n';
  }
  return 0;
}
