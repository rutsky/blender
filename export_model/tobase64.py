import sys

def main():
    if len(sys.argv) != 2:
        print("Usage: {0} file".format(sys.argv[0]))
    else:
        filename = sys.argv[1]
        with open(filename, "rb") as f:
            data = f.read()

        with open(filename + ".txt", "wt") as f:
            f.write(data.encode('base64'))

if __name__ == '__main__':
    main()
